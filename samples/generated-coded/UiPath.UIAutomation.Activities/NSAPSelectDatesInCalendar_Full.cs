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
    // tools/ir/gen-coded.ts で IR（NSAPSelectDatesInCalendar_Full）から生成。手で直さず IR を直す
    public class NSAPSelectDatesInCalendar_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // SAP セッションを使う
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:\\Program Files (x86)\\SAP\\FrontEnd\\SAPgui\\saplogon.exe", Selector = "<wnd app='saplogon.exe' cls='SAP_FRONTEND_SESSION' />" }, targetAppOptions: new TargetAppOptions { OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.IfNotOpen, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Never }))
            {
                // カレンダから日付を選択（全部入り）
                app1.SAPSelectDatesInCalendar(target: new TargetAnchorableModel { PartialSelector = "<sap id='wnd[0]/usr/cntlCAL/shellcont/shell' />", ScopeSelector = "<wnd app='saplogon.exe' cls='SAP_FRONTEND_SESSION' />", SearchSteps = UiPath.UIAutomationNext.Enums.TargetSearchSteps.Selector }, sapSelectDatesInCalendarOptions: new SAPSelectDatesInCalendarOptions { SelectType = UiPath.UIAutomationNext.Enums.NDateSelectionType.Range, Date = new DateTime(2026, 10, 30), StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2026, 10, 31), Year = 2026, Week = 44, Timeout = 30, DelayAfter = 0.2, DelayBefore = 0.2, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.SameAsCard, Description = "SAP 画面の操作" });
                Log(message: "NSAPSelectDatesInCalendar 完了（全部入り）", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
