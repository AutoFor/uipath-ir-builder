// アクティビティDLLから型情報をリフレクションで抜き出し、カタログJSONを出す。
// DLLはロードせず MetadataLoadContext で読むだけなので、Studio も UiPath の実行環境も不要。
//
// 使い方:
//   dotnet run -- --package UiPath.System.Activities --version 26.2.6 \
//     --dll <path>.dll [--dll ...] --nuget-root <~/.nuget/packages> --out catalog/x.json

using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

var opts = Options.Parse(args);
var resolver = new PathAssemblyResolver(ReferencePaths.Collect(opts));
using var mlc = new MetadataLoadContext(resolver, "System.Runtime");

var warnings = new List<string>();
var activities = new List<ActivityInfo>();
var services = new List<ServiceInfo>();

foreach (var dll in opts.Dlls)
{
    var asm = mlc.LoadFromAssemblyPath(dll);
    var xmlnsMap = Xmlns.ReadDefinitions(asm);

    Type[] types;
    try { types = asm.GetTypes(); }
    catch (ReflectionTypeLoadException ex)
    {
        types = ex.Types.Where(t => t != null).ToArray()!;
        warnings.Add($"{asm.GetName().Name}: GetTypes partially failed ({ex.LoaderExceptions.Length} errors)");
    }

    foreach (var t in types)
    {
        try
        {
            if (Services.IsService(t)) { services.Add(Services.Describe(t)); continue; }
            if (!t.IsPublic || t.IsAbstract || t.IsInterface || !Activities.IsActivity(t)) continue;
            activities.Add(Activities.Describe(t, xmlnsMap, warnings));
        }
        catch (Exception ex)
        {
            warnings.Add($"{t.FullName}: {ex.GetType().Name}: {ex.Message}");
        }
    }
}

var catalog = new Catalog(opts.Package, opts.Version, opts.Dlls.Select(Path.GetFileName).ToList()!,
    activities.OrderBy(a => a.ClassName).ToList(), services.Count > 0 ? services.OrderBy(s => s.ClrType).ToList() : null, warnings);

Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(opts.Out))!);
File.WriteAllText(opts.Out, JsonSerializer.Serialize(catalog, Json.Options));
Console.WriteLine($"{opts.Package} {opts.Version}: {activities.Count} activities, {services.Count} coded services, {warnings.Count} warnings -> {opts.Out}");

// ---------------------------------------------------------------------------

record Catalog(string Package, string Version, List<string> Assemblies, List<ActivityInfo> Activities, List<ServiceInfo>? Services, List<string> Warnings);

// Coded Workflow から呼ぶサービス（system.LogMessage(...) の system の型）
record ServiceInfo(string Name, string ClrType, string Assembly, List<string> Bases, List<MethodSig> Methods);

record MethodSig(string Name, string Returns, List<ParamSig> Params, List<string>? TypeParams, bool Obsolete);

record ParamSig(string Name, string Type, string? Modifier, bool Optional, string? Default, bool Params);

record ActivityInfo(
    string ClassName,
    string ClrType,
    string Assembly,
    string Xmlns,
    int GenericArity,
    string? BaseType,
    string? DisplayName,
    string? Category,
    bool Obsolete,
    bool Browsable,
    List<PropInfo> Props);

record PropInfo(
    string Name,
    // in / out / inout: Argument系、child: 子アクティビティ1つ、children: 子のリスト、
    // delegate: ActivityAction/ActivityFunc、prop: それ以外の素のプロパティ
    string Kind,
    string Type,
    bool Required,
    string? Default,
    List<string>? Enum,
    string? Category,
    string? DisplayName,
    bool Browsable,
    List<string>? OverloadGroups,
    bool Obsolete,
    string DeclaredOn);

static class Activities
{
    const string ActivityBase = "System.Activities.Activity";

    // DisplayName 以外は System.Activities の基底クラスが持つ内部向けプロパティなので落とす
    static readonly HashSet<string> BaseKeep = ["DisplayName"];

    public static bool IsActivity(Type t)
    {
        for (var b = t.BaseType; b != null; b = b.BaseType)
            if (b.FullName == ActivityBase) return true;
        return false;
    }

    public static ActivityInfo Describe(Type t, Dictionary<string, string> xmlnsMap, List<string> warnings)
    {
        var attrs = Attrs.Of(t.GetCustomAttributesData());
        var ns = t.Namespace ?? "";
        var asmName = t.Assembly.GetName().Name!;
        var xmlns = xmlnsMap.TryGetValue(ns, out var x) ? x : $"clr-namespace:{ns};assembly={asmName}";
        var arity = t.IsGenericTypeDefinition ? t.GetGenericArguments().Length : 0;

        var props = new List<PropInfo>();
        foreach (var p in t.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            try
            {
                if (p.GetMethod is not { IsPublic: true } || p.GetIndexParameters().Length > 0) continue;
                var declared = p.DeclaringType!;
                if (declared.Namespace == "System.Activities" && !BaseKeep.Contains(p.Name)) continue;
                props.Add(DescribeProp(p));
            }
            catch (Exception ex)
            {
                warnings.Add($"{t.FullName}.{p.Name}: {ex.GetType().Name}: {ex.Message}");
            }
        }

        return new ActivityInfo(
            ClassName: TypeNames.StripArity(t.Name),
            ClrType: TypeNames.StripArity(t.FullName ?? t.Name),
            Assembly: asmName,
            Xmlns: xmlns,
            GenericArity: arity,
            BaseType: t.BaseType == null ? null : TypeNames.Format(t.BaseType),
            DisplayName: attrs.DisplayName,
            Category: attrs.Category,
            Obsolete: attrs.Obsolete,
            Browsable: attrs.Browsable,
            Props: props.OrderBy(p => p.Name).ToList());
    }

    static PropInfo DescribeProp(PropertyInfo p)
    {
        var pt = p.PropertyType;
        var (kind, inner) = Classify(pt);
        var a = Attrs.Of(p.GetCustomAttributesData());
        var valueType = inner ?? pt;
        var enumType = valueType.IsEnum ? valueType : Nullable.GetUnderlyingType(valueType) is { IsEnum: true } nu ? nu : null;

        return new PropInfo(
            Name: p.Name,
            Kind: kind,
            Type: TypeNames.Format(inner ?? pt),
            Required: a.Required,
            Default: a.Default,
            Enum: enumType?.GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => f.Name).ToList(),
            Category: a.Category,
            DisplayName: a.DisplayName,
            Browsable: a.Browsable,
            OverloadGroups: a.OverloadGroups.Count > 0 ? a.OverloadGroups : null,
            Obsolete: a.Obsolete,
            DeclaredOn: TypeNames.StripArity(p.DeclaringType!.Name));
    }

    // 戻り値の inner は Argument の T など「中身の型」
    static (string kind, Type? inner) Classify(Type pt)
    {
        if (pt.IsGenericType)
        {
            var def = pt.GetGenericTypeDefinition().FullName;
            var arg0 = pt.GetGenericArguments()[0];
            switch (def)
            {
                case "System.Activities.InArgument`1": return ("in", arg0);
                case "System.Activities.OutArgument`1": return ("out", arg0);
                case "System.Activities.InOutArgument`1": return ("inout", arg0);
                case "System.Activities.Activity`1": return ("child", null);
            }
            if (def != null && (def.StartsWith("System.Activities.ActivityAction`") || def.StartsWith("System.Activities.ActivityFunc`")))
                return ("delegate", null);
            if (IsActivityType(arg0) && IsCollection(pt)) return ("children", null);
        }
        if (pt.FullName is "System.Activities.InArgument" or "System.Activities.OutArgument") return (pt.Name == "InArgument" ? "in" : "out", null);
        if (pt.FullName is "System.Activities.ActivityAction" ) return ("delegate", null);
        if (IsActivityType(pt)) return ("child", null);
        return ("prop", null);
    }

    static bool IsActivityType(Type t) => t.FullName == ActivityBase || IsActivity(t);

    static bool IsCollection(Type t) =>
        t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition().FullName == "System.Collections.Generic.ICollection`1");
}

// 属性は名前で見る（UiPath は LocalizedDisplayName などの独自派生を使うため、型の厳密一致では拾えない）
record AttrSummary(bool Required, string? Default, string? Category, string? DisplayName, bool Browsable,
    List<string> OverloadGroups, bool Obsolete);

static class Services
{
    // Coded の API は "<名前空間>.API" 配下の公開インターフェース（ISystemService、IUiAutomationAppService など）
    // それに加えて、Coded Workflow の基底クラス CodedWorkflowBase（Log、RunWorkflow、Delay など。protected も含む）
    public static bool IsService(Type t) =>
        (t.IsPublic && t.IsInterface && t.Name.EndsWith("Service") && (t.Namespace ?? "").Split('.').Contains("API"))
        || t.FullName == "UiPath.CodedWorkflows.CodedWorkflowBase";

    public static ServiceInfo Describe(Type t)
    {
        var methods = new List<MethodSig>();
        // クラスは自分で宣言した public / protected のメソッドだけ（object のメソッドは要らない）
        var all = t.IsInterface
            ? t.GetMethods()
            : t.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
                .Where(m => m.IsPublic || m.IsFamily || m.IsFamilyOrAssembly).ToArray();
        foreach (var m in all.Where(m => !m.IsSpecialName))
        {
            var ps = m.GetParameters().Select(p =>
            {
                var pt = p.ParameterType;
                string? mod = pt.IsByRef ? (p.IsOut ? "out" : "ref") : null;
                if (pt.IsByRef) pt = pt.GetElementType()!;
                string? def = null;
                if (p.HasDefaultValue)
                {
                    try { def = p.RawDefaultValue switch { null => "null", string s => $"\"{s}\"", bool b => b ? "true" : "false", var o => o.ToString() }; }
                    catch { def = "?"; }
                }
                var isParams = p.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ParamArrayAttribute");
                return new ParamSig(p.Name ?? "", TypeNames.Format(pt), mod, p.IsOptional, def, isParams);
            }).ToList();
            var tps = m.IsGenericMethodDefinition ? m.GetGenericArguments().Select(a => a.Name).ToList() : null;
            var obsolete = m.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ObsoleteAttribute");
            methods.Add(new MethodSig(m.Name, TypeNames.Format(m.ReturnType), ps, tps, obsolete));
        }
        var bases = t.GetInterfaces().Select(TypeNames.Format).ToList();
        return new ServiceInfo(t.Name, TypeNames.Format(t), t.Assembly.GetName().Name!, bases,
            methods.OrderBy(m => m.Name).ThenBy(m => m.Params.Count).ToList());
    }
}

static class Attrs
{
    public static AttrSummary Of(IList<CustomAttributeData> data)
    {
        bool required = false, obsolete = false, browsable = true;
        string? def = null, cat = null, disp = null;
        var groups = new List<string>();

        foreach (var a in data)
        {
            string name;
            try { name = a.AttributeType.Name; } catch { continue; }
            var args = SafeArgs(a);

            switch (name)
            {
                case "RequiredArgumentAttribute": required = true; break;
                case "ObsoleteAttribute": obsolete = true; break;
                case "BrowsableAttribute": browsable = args.FirstOrDefault() is not false; break;
                case "DefaultValueAttribute": def = args.Count switch { 0 => null, 1 => Str(args[0]), _ => Str(args[^1]) }; break;
                case "OverloadGroupAttribute": if (args.FirstOrDefault() is string g) groups.Add(g); break;
                default:
                    if (name.EndsWith("CategoryAttribute")) cat ??= args.FirstOrDefault() as string;
                    else if (name.EndsWith("DisplayNameAttribute")) disp ??= args.FirstOrDefault() as string;
                    break;
            }
        }
        return new AttrSummary(required, def, cat, disp, browsable, groups, obsolete);
    }

    static List<object?> SafeArgs(CustomAttributeData a)
    {
        try { return a.ConstructorArguments.Select(c => c.Value).ToList(); }
        catch { return []; }
    }

    static string? Str(object? v) => v switch
    {
        null => null,
        bool b => b ? "true" : "false",
        Type t => TypeNames.Format(t),
        _ => v.ToString(),
    };
}

static class Xmlns
{
    // [assembly: XmlnsDefinition("http://...", "Clr.Namespace")] を読む
    public static Dictionary<string, string> ReadDefinitions(Assembly asm)
    {
        var map = new Dictionary<string, string>();
        foreach (var a in asm.GetCustomAttributesData())
        {
            try
            {
                if (a.AttributeType.Name != "XmlnsDefinitionAttribute") continue;
                var args = a.ConstructorArguments;
                if (args.Count >= 2 && args[0].Value is string xml && args[1].Value is string clr)
                    map.TryAdd(clr, xml);
            }
            catch { }
        }
        return map;
    }
}

static class TypeNames
{
    public static string StripArity(string name)
    {
        var i = name.IndexOf('`');
        return i < 0 ? name : name[..i];
    }

    public static string Format(Type t)
    {
        try
        {
            if (t.IsGenericParameter) return t.Name;
            if (t.IsArray) return Format(t.GetElementType()!) + "[]";
            if (Nullable.GetUnderlyingType(t) is { } u) return Format(u) + "?";
            var name = StripArity(t.FullName ?? t.Name);
            if (!t.IsGenericType) return name;
            return $"{name}<{string.Join(", ", t.GetGenericArguments().Select(Format))}>";
        }
        catch (Exception ex) { return $"?{t.Name}({ex.GetType().Name})"; }
    }
}

static class ReferencePaths
{
    static readonly string[] Tfms = ["net8.0", "net7.0", "net6.0", "netstandard2.1", "netstandard2.0", "netcoreapp3.1"];

    // 参照解決用のDLLを集める。.NET 共有フレームワーク + nuget キャッシュ内の .NET 6 以降向け lib/build。
    // 同名DLLは nuget 側で新しいバージョンを優先する（PathAssemblyResolver は同名が複数あると最大バージョンを選ぶ）。
    public static List<string> Collect(Options o)
    {
        var paths = new List<string>();
        foreach (var fw in new[] { "Microsoft.NETCore.App", "Microsoft.WindowsDesktop.App" })
        {
            var dir = Path.Combine(o.DotnetRoot, "shared", fw);
            var ver = Directory.Exists(dir)
                ? Directory.GetDirectories(dir).Select(Path.GetFileName).Where(v => v!.StartsWith("8.")).OrderBy(v => v).LastOrDefault()
                : null;
            if (ver != null) paths.AddRange(Directory.GetFiles(Path.Combine(dir, ver), "*.dll"));
        }

        foreach (var dll in Directory.EnumerateFiles(o.NugetRoot, "*.dll", SearchOption.AllDirectories))
        {
            var parts = dll.Replace('\\', '/').Split('/');
            if (parts.Length < 3) continue;
            var tfm = parts[^2];
            if (!Tfms.Any(f => tfm.StartsWith(f))) continue;
            if (dll.EndsWith(".resources.dll", StringComparison.OrdinalIgnoreCase)) continue;
            if (parts.Any(p => p is "ref" or "runtimes" or "tools" or "analyzers")) continue;
            paths.Add(dll);
        }

        // 同名アセンブリが複数あると MetadataLoadContext が FileLoadException を出すので、名前ごとに1つに絞る。
        // 対象パッケージ自身のフォルダにあるものを最優先し、それ以外は最大バージョンを選ぶ。
        var own = o.Dlls.Concat(o.Dlls.SelectMany(d => Directory.GetFiles(Path.GetDirectoryName(d)!, "*.dll"))).ToList();
        var picked = new Dictionary<string, (string path, Version ver, bool own)>(StringComparer.OrdinalIgnoreCase);
        foreach (var (path, isOwn) in own.Select(p => (p, true)).Concat(paths.Select(p => (p, false))))
        {
            AssemblyName an;
            try { an = AssemblyName.GetAssemblyName(path); } catch { continue; }
            var ver = an.Version ?? new Version(0, 0);
            if (picked.TryGetValue(an.Name!, out var cur) && (cur.own || (!isOwn && cur.ver >= ver))) continue;
            picked[an.Name!] = (path, ver, isOwn);
        }
        return picked.Values.Select(v => v.path).ToList();
    }
}

record Options(string Package, string Version, List<string> Dlls, string NugetRoot, string DotnetRoot, string Out)
{
    public static Options Parse(string[] args)
    {
        string? package = null, version = null, nuget = null, outp = null;
        var dotnet = @"C:\Program Files\dotnet";
        var dlls = new List<string>();
        for (var i = 0; i < args.Length; i++)
        {
            var v = i + 1 < args.Length ? args[i + 1] : throw new ArgumentException($"missing value for {args[i]}");
            switch (args[i])
            {
                case "--package": package = v; break;
                case "--version": version = v; break;
                case "--dll": dlls.Add(Path.GetFullPath(v)); break;
                case "--nuget-root": nuget = v; break;
                case "--dotnet-root": dotnet = v; break;
                case "--out": outp = v; break;
                default: throw new ArgumentException($"unknown option {args[i]}");
            }
            i++;
        }
        nuget ??= Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nuget", "packages");
        if (package == null || version == null || outp == null || dlls.Count == 0)
            throw new ArgumentException("required: --package --version --dll --out");
        return new Options(package, version, dlls, nuget, dotnet, outp);
    }
}

static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };
}
