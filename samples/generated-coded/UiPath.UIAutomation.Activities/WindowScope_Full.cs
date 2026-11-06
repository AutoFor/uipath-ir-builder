using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WindowScope_Full）から生成。手で直さず IR を直す
    public class WindowScope_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String notePath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-c3-note.txt");
            Window win = default;
            // メモ帳に開かせるファイルを書く
            system.WriteTextFile(text: "uia-c3", file: LocalResource.FromPath(notePath));
            // メモ帳を起動する
            // StartProcess はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_activities/StartProcess_5d9600.xaml）
            RunWorkflow("coded/_activities/StartProcess_5d9600.xaml", new Dictionary<string, object> { ["in_Arguments"] = notePath, ["in_FileName"] = "notepad.exe" });
            // メモ帳のウィンドウに入る
            // WindowScope はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/WindowScope_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/WindowScope_Full_1.xaml", new Dictionary<string, object> { ["win"] = win });
            win = (Window)__xaml1["win"];
        }
    }
}
