using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ForEachFileX_Min）から生成。手で直さず IR を直す
    public class ForEachFileX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\ForEachFileX_Min.d"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\ForEachFileX_Min.d");
            system.WriteTextFile(text: "b", file: LocalResource.FromPath("output\\ForEachFileX_Min.d\\b.txt"));
            system.WriteTextFile(text: "a", file: LocalResource.FromPath("output\\ForEachFileX_Min.d\\a.txt"));
            system.WriteTextFile(text: "c", file: LocalResource.FromPath("output\\ForEachFileX_Min.d\\c.log"));
            // ForEachFileX はCoded API が無い（Coded API なし（ファイルの列挙は System.IO.Directory.EnumerateFiles などの .NET の機能。サービスにメソッドが無い））ので XAML 経由（coded/_xaml/ForEachFileX_Min_1.xaml）
            RunWorkflow("coded/_xaml/ForEachFileX_Min_1.xaml", null);
        }
    }
}
