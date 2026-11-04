// アクティビティDLLから型情報をリフレクションで抜き出し、カタログJSONを出す。
// DLLはロードせず MetadataLoadContext で読むだけなので、Studio も UiPath の実行環境も不要。
//
// 使い方:
//   dotnet run -- --package UiPath.System.Activities --version 26.2.6 \
//     --dll <path>.dll [--dll ...] --nuget-root <~/.nuget/packages> --out catalog/x.json [--follow-returns]

using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ecma335 = System.Reflection.Metadata.Ecma335;
using Emit = System.Reflection.Emit;
using PE = System.Reflection.PortableExecutable;
using SRM = System.Reflection.Metadata;

var opts = Options.Parse(args);
var resolver = new PathAssemblyResolver(ReferencePaths.Collect(opts));
using var mlc = new MetadataLoadContext(resolver, "System.Runtime");

var warnings = new List<string>();
if (opts.Types != null) { ObjectTypes.Dump(mlc, opts, warnings); return; }
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

// --follow-returns: Coded の API をたどる。
//   handles    … サービスのメソッドが返す型（excel.UseExcelFile(...) の IWorkbookQuickHandle など）と、そのメソッド・プロパティ・
//                引数の型を、たどれるだけ（UiPath.* の型だけ）。インデクサーは "this[System.String]" という名前のプロパティ
//   extensions … 入力 DLL の "<名前空間>.API" 配下の公開 static クラスの拡張メソッド（ExcelOperations.ReadRange(this IReadRangeRef ...) など）。最初の引数が this
//   enums      … たどった型に出てくる UiPath.* の enum のメンバー名
var handles = new List<ServiceInfo>();
var extensions = new List<ServiceInfo>();
var enums = new SortedDictionary<string, List<string>>();
if (opts.FollowReturns)
{
    var seen = new HashSet<string>(services.Select(s => s.ClrType));
    var queue = new Queue<Type>();
    void Enqueue(Type rt)
    {
        try
        {
            if (rt.IsByRef || rt.IsArray) rt = rt.GetElementType()!;
            if (Nullable.GetUnderlyingType(rt) is { } nu) rt = nu;
            if (rt.IsGenericType && !rt.IsGenericTypeDefinition) { foreach (var g in rt.GetGenericArguments()) Enqueue(g); if (!(rt.Namespace ?? "").StartsWith("UiPath.")) return; }
            if (rt.IsGenericParameter || !(rt.Namespace ?? "").StartsWith("UiPath.")) return;
            if (rt.IsEnum) { enums.TryAdd(TypeNames.Format(rt), rt.GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => f.Name).ToList()); return; }
            if (rt.IsValueType && !rt.IsGenericType) return;
            if (seen.Add(TypeNames.Format(rt))) queue.Enqueue(rt);
        }
        catch (Exception ex) { warnings.Add($"follow {rt.Name}: {ex.GetType().Name}: {ex.Message}"); }
    }
    void EnqueueSig(MethodInfo m) { Enqueue(m.ReturnType); foreach (var p in m.GetParameters()) Enqueue(p.ParameterType); }
    foreach (var dll in opts.Dlls)
        foreach (var t in mlc.LoadFromAssemblyPath(dll).GetTypes().Where(t => t.IsPublic))
        {
            try
            {
                if (Services.IsService(t)) foreach (var m in t.GetMethods()) EnqueueSig(m);
                else if (Services.IsExtensionClass(t))
                {
                    extensions.Add(Services.Describe(t));
                    foreach (var m in t.GetMethods(BindingFlags.Public | BindingFlags.Static)) EnqueueSig(m);
                }
            }
            catch (Exception ex) { warnings.Add($"{t.FullName}: {ex.GetType().Name}: {ex.Message}"); }
        }
    while (queue.Count > 0)
    {
        var t = queue.Dequeue();
        try
        {
            var info = Services.DescribeHandle(t);
            if (info.Methods.Count == 0 && (info.Properties?.Count ?? 0) == 0) continue;
            handles.Add(info);
            foreach (var m in Services.HandleMethods(t)) EnqueueSig(m);
            foreach (var p in Services.HandleProperties(t)) Enqueue(p.PropertyType);
        }
        catch (Exception ex) { warnings.Add($"{t.FullName}: {ex.GetType().Name}: {ex.Message}"); }
    }
}

var registries = opts.Dlls.SelectMany(d => Registries.Read(d, warnings)).ToList();

var catalog = new Catalog(opts.Package, opts.Version, opts.Dlls.Select(Path.GetFileName).ToList()!,
    activities.OrderBy(a => a.ClassName).ToList(), services.Count > 0 ? services.OrderBy(s => s.ClrType).ToList() : null,
    handles.Count > 0 ? handles.OrderBy(s => s.ClrType).ToList() : null,
    extensions.Count > 0 ? extensions.OrderBy(s => s.ClrType).ToList() : null,
    enums.Count > 0 ? enums : null, warnings, registries.Count > 0 ? registries : null);

Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(opts.Out))!);
File.WriteAllText(opts.Out, JsonSerializer.Serialize(catalog, Json.Options));
Console.WriteLine($"{opts.Package} {opts.Version}: {activities.Count} activities, {services.Count} coded services{(opts.FollowReturns ? $", {handles.Count} handles, {extensions.Count} extension classes, {enums.Count} enums" : "")}, {warnings.Count} warnings -> {opts.Out}");

// ---------------------------------------------------------------------------

record Catalog(string Package, string Version, List<string> Assemblies, List<ActivityInfo> Activities, List<ServiceInfo>? Services, List<ServiceInfo>? Handles,
    List<ServiceInfo>? Extensions, SortedDictionary<string, List<string>>? Enums, List<string> Warnings, List<RegistryInfo>? CodedRegistries = null);

// Coded のサービスの登録（[assembly: CodedWorkflowsServiceRegistry(typeof(X))] の X）。Studio はこれを読んで
// .local/.codedworkflows/CodedWorkflow.cs を作る。vars は変数名 → 型（excel → IExcelService）、namespaces はそのファイルに足す using
record RegistryInfo(string Type, SortedDictionary<string, string> Vars, List<string> Namespaces);

// Coded Workflow から呼ぶサービス（system.LogMessage(...) の system の型）
record ServiceInfo(string Name, string ClrType, string Assembly, List<string> Bases, List<MethodSig> Methods, List<PropSig>? Properties = null);

// handles の読めるプロパティ（ISheet.Name など）
record PropSig(string Name, string Type, bool CanWrite);

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
    string DeclaredOn,
    bool? ReadOnly = null,
    // enum に独自の TypeConverter がある（Testing の VerificationType など、表示名で読み書きする）。XAML には {x:Static} で書く
    string? EnumConverter = null,
    string? EnumAssembly = null);

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
                // Activity<T>.Result は XAML に Result="[変数]" で書ける出力なので残す。派生が同じ名前を宣言していれば、そちらを使う
                var isResult = p.Name == "Result" && declared.IsGenericType && declared.GetGenericTypeDefinition().FullName == "System.Activities.Activity`1";
                if (isResult && t.GetProperties(BindingFlags.Public | BindingFlags.Instance).Any(q => q.Name == "Result" && q.DeclaringType?.Namespace != "System.Activities")) continue;
                if (declared.Namespace == "System.Activities" && !BaseKeep.Contains(p.Name) && !isResult) continue;
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
        var converter = enumType == null ? null : Converter(p.GetCustomAttributesData()) ?? Converter(enumType.GetCustomAttributesData());

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
            DeclaredOn: TypeNames.StripArity(p.DeclaringType!.Name),
            // public の setter が無い。コレクションは XAML が既存のものに要素を足せるので、読み取り専用に数えない
            ReadOnly: p.SetMethod is not { IsPublic: true } && !IsCollectionLike(pt) ? true : null,
            EnumConverter: converter,
            EnumAssembly: converter == null ? null : enumType!.Assembly.GetName().Name);
    }

    // [TypeConverter(typeof(X))] の X（System の標準のものは除く）
    static string? Converter(IList<CustomAttributeData> attrs)
    {
        var a = attrs.FirstOrDefault(x => x.AttributeType.FullName == "System.ComponentModel.TypeConverterAttribute");
        var t = a?.ConstructorArguments.FirstOrDefault().Value switch { Type ty => ty.FullName, string str => str.Split(',')[0], _ => null };
        return t == null || t.StartsWith("System.") ? null : t;
    }

    static bool IsCollectionLike(Type t) =>
        t.GetInterfaces().Concat([t]).Any(i => i.FullName is "System.Collections.IList" or "System.Collections.IDictionary"
            || (i.IsGenericType && i.GetGenericTypeDefinition().FullName is "System.Collections.Generic.ICollection`1" or "System.Collections.Generic.IDictionary`2"));

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

    // 拡張メソッドを持つ公開 static クラス（サービスと同じく "<名前空間>.API" 配下のもの。例 ExcelOperations）
    public static bool IsExtensionClass(Type t) =>
        t.IsPublic && (t.Namespace ?? "").Split('.').Contains("API") && t.IsAbstract && t.IsSealed && t.GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Any(m => m.GetCustomAttributesData().Any(a => a.AttributeType.Name == "ExtensionAttribute"));

    public static ServiceInfo Describe(Type t)
    {
        // クラスは自分で宣言した public / protected のメソッドだけ（object のメソッドは要らない）
        var all = t.IsInterface
            ? t.GetMethods()
            : t.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly)
                .Where(m => m.IsPublic || m.IsFamily || m.IsFamilyOrAssembly).ToArray();
        var methods = all.Where(m => !m.IsSpecialName).Select(Sig).ToList();
        var bases = t.GetInterfaces().Select(TypeNames.Format).ToList();
        return new ServiceInfo(t.Name, TypeNames.Format(t), t.Assembly.GetName().Name!, bases,
            methods.OrderBy(m => m.Name).ThenBy(m => m.Params.Count).ToList());
    }

    // 戻り値の型（handle）の public メソッド。インターフェースは継承元のインターフェースのメソッドも含める
    public static IEnumerable<MethodInfo> HandleMethods(Type t)
    {
        var types = t.IsInterface ? new[] { t }.Concat(t.GetInterfaces()) : new[] { t };
        return types.SelectMany(x => x.GetMethods(BindingFlags.Public | BindingFlags.Instance | (t.IsInterface ? 0 : BindingFlags.Static)))
            .Where(m => !m.IsSpecialName && m.DeclaringType?.FullName != "System.Object" && !(m.DeclaringType?.Namespace ?? "").StartsWith("System"));
    }

    public static IEnumerable<PropertyInfo> HandleProperties(Type t)
    {
        var types = t.IsInterface ? new[] { t }.Concat(t.GetInterfaces()) : new[] { t };
        return types.SelectMany(x => x.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            .Where(p => !(p.DeclaringType?.Namespace ?? "").StartsWith("System"));
    }

    public static ServiceInfo DescribeHandle(Type t)
    {
        var methods = HandleMethods(t).Select(Sig).GroupBy(m => $"{m.Name}({string.Join(",", m.Params.Select(p => p.Type))})").Select(g => g.First());
        // インデクサー（sheet.Range["A1"] など）は "this[System.String]" の名前で書く
        static string PropName(PropertyInfo p) => p.GetIndexParameters() is { Length: > 0 } ix ? $"this[{string.Join(", ", ix.Select(i => TypeNames.Format(i.ParameterType)))}]" : p.Name;
        var props = HandleProperties(t).GroupBy(PropName).Select(g => g.First())
            .Select(p => new PropSig(PropName(p), TypeNames.Format(p.PropertyType), p.SetMethod is { IsPublic: true })).OrderBy(p => p.Name).ToList();
        var bases = t.GetInterfaces().Select(TypeNames.Format).ToList();
        return new ServiceInfo(t.Name, TypeNames.Format(t), t.Assembly.GetName().Name!, bases,
            methods.OrderBy(m => m.Name).ThenBy(m => m.Params.Count).ToList(), props.Count > 0 ? props : null);
    }

    static MethodSig Sig(MethodInfo m)
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
        return new MethodSig(m.Name, TypeNames.Format(m.ReturnType), ps, tps, obsolete);
    }
}

// Coded のサービスの登録クラスを読む。変数名は属性やシグネチャには無く、AutoImportedTypes の getter の IL にある
// （ldstr "excel"; ldtoken IExcelService; ... Add）。MetadataLoadContext は IL の文字列を引けないので、System.Reflection.Metadata で直接読む
static class Registries
{
    static readonly Dictionary<short, Emit.OpCode> OpCodes = typeof(Emit.OpCodes)
        .GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => (Emit.OpCode)f.GetValue(null)!).ToDictionary(o => o.Value);

    public static List<RegistryInfo> Read(string dll, List<string> warnings)
    {
        var result = new List<RegistryInfo>();
        using var pe = new PE.PEReader(File.OpenRead(dll));
        var md = SRM.PEReaderExtensions.GetMetadataReader(pe);
        foreach (var ah in md.GetCustomAttributes(SRM.EntityHandle.AssemblyDefinition))
        {
            var a = md.GetCustomAttribute(ah);
            if (a.Constructor.Kind != SRM.HandleKind.MemberReference) continue;
            var parent = md.GetMemberReference((SRM.MemberReferenceHandle)a.Constructor).Parent;
            if (Name(md, parent) != "UiPath.CodedWorkflows.CodedWorkflowsServiceRegistryAttribute") continue;
            var blob = md.GetBlobReader(a.Value);
            blob.ReadUInt16(); // prolog
            var typeName = blob.ReadSerializedString()!.Split(',')[0];
            var td = md.TypeDefinitions.Select(md.GetTypeDefinition).FirstOrDefault(t => md.GetString(t.Namespace) + "." + md.GetString(t.Name) == typeName);
            if (td.Equals(default(SRM.TypeDefinition))) { warnings.Add($"{Path.GetFileName(dll)}: 登録クラス {typeName} が DLL に無い"); continue; }
            var vars = new SortedDictionary<string, string>();
            var namespaces = new List<string>();
            foreach (var mh in td.GetMethods())
            {
                var m = md.GetMethodDefinition(mh);
                var name = md.GetString(m.Name);
                if (m.RelativeVirtualAddress == 0 || (name != "get_AutoImportedTypes" && name != "get_AutoImportedNamespaces")) continue;
                string? pending = null;
                foreach (var (op, token) in Walk(SRM.PEReaderExtensions.GetMethodBody(pe, m.RelativeVirtualAddress).GetILBytes()!))
                {
                    if (op == Emit.OpCodes.Ldstr.Value)
                    {
                        var s = md.GetUserString(Ecma335.MetadataTokens.UserStringHandle(token & 0xFFFFFF));
                        if (name == "get_AutoImportedNamespaces") namespaces.Add(s); else pending = s;
                    }
                    else if (op == Emit.OpCodes.Ldtoken.Value && pending != null)
                    {
                        vars[pending] = Name(md, Ecma335.MetadataTokens.EntityHandle(token));
                        pending = null;
                    }
                }
            }
            if (vars.Count == 0) warnings.Add($"{Path.GetFileName(dll)}: {typeName} から変数名を読めなかった");
            result.Add(new RegistryInfo(typeName, vars, namespaces));
        }
        return result;
    }

    // IL を命令ごとに読む。トークンを持つ命令（InlineString / InlineTok など 4 バイト）だけ token を返す
    static IEnumerable<(short Op, int Token)> Walk(byte[] il)
    {
        for (int i = 0; i < il.Length;)
        {
            short v = il[i] == 0xFE ? (short)(0xFE00 | il[i + 1]) : il[i];
            var op = OpCodes[v];
            i += op.Size;
            var operand = op.OperandType switch
            {
                Emit.OperandType.InlineNone => 0,
                Emit.OperandType.ShortInlineBrTarget or Emit.OperandType.ShortInlineI or Emit.OperandType.ShortInlineVar => 1,
                Emit.OperandType.InlineVar => 2,
                Emit.OperandType.InlineI8 or Emit.OperandType.InlineR => 8,
                Emit.OperandType.InlineSwitch => 4 + 4 * BitConverter.ToInt32(il, i),
                _ => 4,
            };
            yield return (v, operand == 4 ? BitConverter.ToInt32(il, i) : 0);
            i += operand;
        }
    }

    static string Name(SRM.MetadataReader md, SRM.EntityHandle h) => h.Kind switch
    {
        SRM.HandleKind.TypeReference => Full(md.GetTypeReference((SRM.TypeReferenceHandle)h).Namespace, md.GetTypeReference((SRM.TypeReferenceHandle)h).Name, md),
        SRM.HandleKind.TypeDefinition => Full(md.GetTypeDefinition((SRM.TypeDefinitionHandle)h).Namespace, md.GetTypeDefinition((SRM.TypeDefinitionHandle)h).Name, md),
        _ => h.Kind.ToString(),
    };

    static string Full(SRM.StringHandle ns, SRM.StringHandle name, SRM.MetadataReader md) =>
        (ns.IsNil ? "" : md.GetString(ns) + ".") + md.GetString(name);
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

// --types <正規表現>：アクティビティではない型（UI のターゲットなど、XAML で要素として書くオブジェクト）の
// 設定できるプロパティを {package, version, objects} の JSON に書き出す（tools/ir/uia.ts が使う）
static class ObjectTypes
{
    public static void Dump(MetadataLoadContext mlc, Options opts, List<string> warnings)
    {
        var re = new System.Text.RegularExpressions.Regex(opts.Types!);
        var objects = new List<ActivityInfo>();
        foreach (var dll in opts.Dlls)
        {
            var asm = mlc.LoadFromAssemblyPath(dll);
            var xmlnsMap = Xmlns.ReadDefinitions(asm);
            Type[] types;
            try { types = asm.GetTypes(); }
            catch (ReflectionTypeLoadException ex) { types = ex.Types.Where(t => t != null).ToArray()!; }
            foreach (var t in types.Where(t => t.IsPublic && !t.IsAbstract && !t.IsInterface && t.FullName != null && re.IsMatch(t.FullName)))
            {
                try
                {
                    var info = Activities.Describe(t, xmlnsMap, warnings);
                    var settable = t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                        .Where(p => p.SetMethod is { IsPublic: true }).Select(p => p.Name).ToHashSet();
                    objects.Add(info with { Props = info.Props.Where(p => settable.Contains(p.Name)).ToList() });
                }
                catch (Exception ex) { warnings.Add($"{t.FullName}: {ex.GetType().Name}: {ex.Message}"); }
            }
        }
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(opts.Out))!);
        File.WriteAllText(opts.Out, JsonSerializer.Serialize(new { opts.Package, opts.Version, Objects = objects.OrderBy(o => o.ClrType).ToList(), Warnings = warnings }, Json.Options));
        Console.WriteLine($"{opts.Package} {opts.Version}: {objects.Count} object types, {warnings.Count} warnings -> {opts.Out}");
    }
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

record Options(string Package, string Version, List<string> Dlls, string NugetRoot, string DotnetRoot, string Out, bool FollowReturns = false, string? Types = null)
{
    public static Options Parse(string[] args)
    {
        string? package = null, version = null, nuget = null, outp = null, types = null;
        var dotnet = @"C:\Program Files\dotnet";
        var dlls = new List<string>();
        var follow = false;
        for (var i = 0; i < args.Length; i++)
        {
            if (args[i] == "--follow-returns") { follow = true; continue; }
            var v = i + 1 < args.Length ? args[i + 1] : throw new ArgumentException($"missing value for {args[i]}");
            switch (args[i])
            {
                case "--package": package = v; break;
                case "--version": version = v; break;
                case "--dll": dlls.Add(Path.GetFullPath(v)); break;
                case "--nuget-root": nuget = v; break;
                case "--dotnet-root": dotnet = v; break;
                case "--out": outp = v; break;
                case "--types": types = v; break;
                default: throw new ArgumentException($"unknown option {args[i]}");
            }
            i++;
        }
        nuget ??= Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nuget", "packages");
        if (package == null || version == null || outp == null || dlls.Count == 0)
            throw new ArgumentException("required: --package --version --dll --out");
        return new Options(package, version, dlls, nuget, dotnet, outp, follow, types);
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
