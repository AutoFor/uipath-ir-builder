using System;
using System.Collections.Generic;
using UiPath.CodedWorkflows;
using UiPath.Core.Activities;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    public class CodedMain : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // Main.json と同じ処理（XAML の Greet.xaml を呼ぶ）
            var count = 0;
            foreach (var name in new[] { "太郎", "花子", "Al", "A" })
            {
                if (name.Length >= 2)
                {
                    var result = RunWorkflow("Greet.xaml", new Dictionary<string, object> { ["in_Name"] = name });
                    Log((string)result["out_Message"]);
                    count++;
                }
                else Log("短すぎる名前: " + name, UiPath.CodedWorkflows.LogLevel.Warn);
            }
            Log("あいさつした人数: " + count);

            // Controls.json のファイル部分を system サービスで
            var items = new List<string> { "item1", "item2", "item3" };
            var file = LocalResource.FromPath("coded-out.txt");
            system.WriteTextFile(system.CombineText(items, ","), file);
            Log("ファイルの中身: " + system.ReadTextFile(file));
        }
    }
}


