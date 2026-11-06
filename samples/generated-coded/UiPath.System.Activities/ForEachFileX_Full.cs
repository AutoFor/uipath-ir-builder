using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ForEachFileX_Full）から生成。手で直さず IR を直す
    public class ForEachFileX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\ForEachFileX_Full.d"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\ForEachFileX_Full.d");
            system.CreateFolder(path: "output\\ForEachFileX_Full.d\\sub");
            system.WriteTextFile(text: "1", file: LocalResource.FromPath("output\\ForEachFileX_Full.d\\a.txt"));
            system.WriteTextFile(text: "123", file: LocalResource.FromPath("output\\ForEachFileX_Full.d\\b.txt"));
            system.WriteTextFile(text: "12", file: LocalResource.FromPath("output\\ForEachFileX_Full.d\\c.log"));
            system.WriteTextFile(text: "12345", file: LocalResource.FromPath("output\\ForEachFileX_Full.d\\sub\\d.txt"));
            // txt を大きい順に（サブフォルダーも）
            // ForEachFileX はCoded API が無い（Coded API なし（ファイルの列挙は System.IO.Directory.EnumerateFiles などの .NET の機能。サービスにメソッドが無い））ので XAML 経由（coded/_xaml/ForEachFileX_Full_1.xaml）
            RunWorkflow("coded/_xaml/ForEachFileX_Full_1.xaml", null);
        }
    }
}
