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
    // tools/ir/gen-coded.ts で IR（NSAPCallTransaction_Min）から生成。手で直さず IR を直す
    public class NSAPCallTransaction_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // SAP セッションを使う
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:\\Program Files (x86)\\SAP\\FrontEnd\\SAPgui\\saplogon.exe", Selector = "<wnd app='saplogon.exe' cls='SAP_FRONTEND_SESSION' />" }, targetAppOptions: new TargetAppOptions { AttachMode = UiPath.UIAutomationNext.Enums.NAppAttachMode.ByInstance, OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.IfNotOpen, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Never, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Job }))
            {
                // トランザクションを呼ぶ
                app1.SAPCallTransaction(sapCallTransactionOptions: new SAPCallTransactionOptions { Transaction = "VA01", Prefix = "/n" });
                Log(message: "NSAPCallTransaction 完了", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
