using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReadStatusbar_Full）から生成。手で直さず IR を直す
    public class ReadStatusbar_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String msgText = default;
            String msgType = default;
            String msgId = default;
            String msgNumber = default;
            String[] msgData = default;
            // SAP Logon を開く（Classic）
            // OpenApplication はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/ReadStatusbar_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ReadStatusbar_Full_1.xaml", new Dictionary<string, object> { ["msgText"] = msgText, ["msgType"] = msgType, ["msgId"] = msgId, ["msgNumber"] = msgNumber, ["msgData"] = msgData });
            msgText = (String)__xaml1["msgText"];
            msgType = (String)__xaml1["msgType"];
            msgId = (String)__xaml1["msgId"];
            msgNumber = (String)__xaml1["msgNumber"];
            msgData = (String[])__xaml1["msgData"];
        }
    }
}
