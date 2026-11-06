using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（OpenApplication_Full）から生成。手で直さず IR を直す
    public class OpenApplication_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String notePath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-c3-note.txt");
            Window win = default;
            // メモ帳に開かせるファイルを書く
            system.WriteTextFile(text: "uia-c3", file: LocalResource.FromPath(notePath));
            // メモ帳を開く（Classic）
            // OpenApplication はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/OpenApplication_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/OpenApplication_Full_1.xaml", new Dictionary<string, object> { ["notePath"] = notePath, ["win"] = win });
            win = (Window)__xaml1["win"];
            Log(message: "closed", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
