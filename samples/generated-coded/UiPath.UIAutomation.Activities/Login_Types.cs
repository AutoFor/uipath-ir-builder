using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Login_Types）から生成。手で直さず IR を直す
    public class Login_Types : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Window win = default;
            Window appWin = default;
            Browser browser = default;
            UiPath.Core.UiElement element = default;
            UiPath.Core.Image image = default;
            System.Drawing.Image drawingImage = default;
            Region region = default;
            System.Drawing.Rectangle rect = new Rectangle(10, 20, 300, 200);
            System.Drawing.Point pt = new Point(10, 20);
            // SAP Logon を開く（Classic）
            // OpenApplication はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/Login_Types_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/Login_Types_1.xaml", new Dictionary<string, object> { ["appWin"] = appWin, ["win"] = win, ["browser"] = browser });
            appWin = (Window)__xaml1["appWin"];
            win = (Window)__xaml1["win"];
        }
    }
}
