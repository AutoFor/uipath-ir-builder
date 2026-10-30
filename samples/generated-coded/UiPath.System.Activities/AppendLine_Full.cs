using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AppendLine_Full）から生成。手で直さず IR を直す
    public class AppendLine_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            String txt = default;
            res = system.CreateFile(name: "AppendLine_Full.txt", path: "output");
            system.WriteTextFile(text: "あ", file: res, encoding: "utf-8");
            // 文字コードを指定して追記
            system.AppendLine(text: "い", file: res, useDefaultEncoding: false, encoding: "utf-8");
            txt = system.ReadTextFile(file: res, encoding: "utf-8");
            Log(message: Convert.ToString(txt.Replace(Environment.NewLine, "|")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
