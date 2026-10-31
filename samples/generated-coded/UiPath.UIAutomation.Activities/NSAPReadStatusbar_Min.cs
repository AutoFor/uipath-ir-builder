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
    // tools/ir/gen-coded.ts で IR（NSAPReadStatusbar_Min）から生成。手で直さず IR を直す
    public class NSAPReadStatusbar_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String sbType = default;
            String sbText = default;
            String sbId = default;
            String sbNumber = default;
            String[] sbData = default;
            // SAP セッションを使う
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:\\Program Files (x86)\\SAP\\FrontEnd\\SAPgui\\saplogon.exe", Selector = "<wnd app='saplogon.exe' cls='SAP_FRONTEND_SESSION' />" }, targetAppOptions: new TargetAppOptions { AttachMode = UiPath.UIAutomationNext.Enums.NAppAttachMode.ByInstance, OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.IfNotOpen, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Never, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Job }))
            {
                // ステータス バーを読み取り
                var __sb = app1.SAPReadStatusbar(readStatusbarOptions: new SAPReadStatusbarOptions { Timeout = 30, DelayAfter = 0.3, DelayBefore = 0.2, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.SameAsCard }); sbType = __sb.MessageType; sbText = __sb.MessageText; sbId = __sb.MessageId; sbNumber = __sb.MessageNumber; sbData = __sb.MessageData;
                Log(message: "ステータス: " + sbType + " " + sbText + " " + sbId + " " + sbNumber + " " + sbData.Length.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                Log(message: "NSAPReadStatusbar 完了", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
