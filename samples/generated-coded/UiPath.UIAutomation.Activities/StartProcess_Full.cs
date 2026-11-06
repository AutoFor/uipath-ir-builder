using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartProcess_Full）から生成。手で直さず IR を直す
    public class StartProcess_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String notePath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-c3-note.txt");
            // メモ帳に開かせるファイルを書く
            system.WriteTextFile(text: "uia-c3", file: LocalResource.FromPath(notePath));
            // メモ帳を起動する
            // StartProcess はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_activities/StartProcess_9e02fc.xaml）
            RunWorkflow("coded/_activities/StartProcess_9e02fc.xaml", new Dictionary<string, object> { ["in_Arguments"] = notePath, ["in_ContinueOnError"] = false, ["in_FileName"] = "notepad.exe", ["in_Timeout"] = 10000, ["in_WorkingDirectory"] = Convert.ToString(System.IO.Path.GetTempPath()) });
            // メモ帳のウィンドウに入って閉じる
            // WindowScope はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/StartProcess_Full_1.xaml）
            RunWorkflow("coded/_xaml/StartProcess_Full_1.xaml", null);
        }
    }
}
