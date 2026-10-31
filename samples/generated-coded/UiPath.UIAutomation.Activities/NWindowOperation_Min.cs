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
    // tools/ir/gen-coded.ts で IR（NWindowOperation_Min）から生成。手で直さず IR を直す
    public class NWindowOperation_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // テスト用のウィンドウを開く
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe", Arguments = "-NoProfile -WindowStyle Hidden -Command \"Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.Form; $f.Text='UIA Window Test'; [System.Windows.Forms.Application]::Run($f)\"", Selector = "<wnd app='powershell.exe' title='UIA Window Test' />" }, targetAppOptions: new TargetAppOptions { AttachMode = UiPath.UIAutomationNext.Enums.NAppAttachMode.ByInstance, OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.Always, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Always, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Job }))
            {
                // ウィンドウを最大化する
                app1.WindowOperation(windowOperationOptions: new WindowOperationOptions { Operation = UiPath.UIAutomationNext.Enums.NWindowOperationType.Maximize });
                Log(message: "maximized", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
