using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.UIAutomationNext.API.Models;
using UiPath.UIAutomationNext.Enums;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NSAPExpandTree_Full）から生成。手で直さず IR を直す
    public class NSAPExpandTree_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // SAP セッションを使う
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:\\Program Files (x86)\\SAP\\FrontEnd\\SAPgui\\saplogon.exe", Selector = "<wnd app='saplogon.exe' cls='SAP_FRONTEND_SESSION' />" }, targetAppOptions: new TargetAppOptions { OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.IfNotOpen, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Never }))
            {
                // ツリーを展開（全部入り）
                app1.SAPExpandTree(target: new TargetAnchorableModel { PartialSelector = "<sap id='wnd[0]/shellcont/shell' />", ScopeSelector = "<wnd app='saplogon.exe' cls='SAP_FRONTEND_SESSION' />", SearchSteps = UiPath.UIAutomationNext.Enums.TargetSearchSteps.Selector }, sapExpandTreeOptions: new SAPExpandTreeOptions { Path = "Root\\Child", Timeout = 30, DelayAfter = 0.2, DelayBefore = 0.2, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.SameAsCard, Description = "SAP 画面の操作" });
                Log(message: "NSAPExpandTree 完了（全部入り）", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
