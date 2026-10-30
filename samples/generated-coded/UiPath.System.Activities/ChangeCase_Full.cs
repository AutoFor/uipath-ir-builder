using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ChangeCase_Full）から生成。手で直さず IR を直す
    public class ChangeCase_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String src = "hELLO wORLD";
            String a = default;
            String b = default;
            String c = default;
            String d = default;
            // 小文字にする
            a = system.ChangeCase(source: src, changeCaseOptions: UiPath.Activities.System.Text.ChangeCaseOptions.LowerCase);
            // 大文字にする
            b = system.ChangeCase(source: src, changeCaseOptions: UiPath.Activities.System.Text.ChangeCaseOptions.UpperCase);
            // 文の先頭だけ大文字にする
            c = system.ChangeCase(source: "HELLO WORLD", changeCaseOptions: UiPath.Activities.System.Text.ChangeCaseOptions.SentenceCase);
            // 各単語の先頭を大文字にする
            d = system.ChangeCase(source: "hello big world", changeCaseOptions: UiPath.Activities.System.Text.ChangeCaseOptions.CapitalizeEachWord);
            Log(message: a, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: b, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: c, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: d, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
