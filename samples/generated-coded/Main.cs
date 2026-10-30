using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Main）から生成。手で直さず IR を直す
    public class Main : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String[] names = new String[] { "太郎", "花子", "Al", "A" };
            Int32 count = 0;
            String message = default;
            // 名前ごとに
            foreach (String name in names)
            {
                // 2文字以上か
                if (name.Length >= 2)
                {
                    // あいさつを作る
                    var __result1 = RunWorkflow("coded/Greet.cs", new Dictionary<string, object> { ["in_Name"] = name });
                    message = (String)__result1["Output"];
                    Log(message: message, level: UiPath.CodedWorkflows.LogLevel.Info);
                    // 数える
                    count = count + 1;
                }
                else
                {
                    Log(message: "短すぎる名前: " + name, level: UiPath.CodedWorkflows.LogLevel.Warn);
                }
            }
            // 件数
            Log(message: "あいさつした人数: " + count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
