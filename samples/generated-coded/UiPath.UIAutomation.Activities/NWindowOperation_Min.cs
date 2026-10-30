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
            String notePath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-m3-note.txt");
            // メモ帳に開かせるファイルを書く
            system.WriteTextFile(text: "uia-m3", file: LocalResource.FromPath(notePath));
            // メモ帳を開く
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:/Windows/System32/notepad.exe", Arguments = notePath, Selector = "<wnd app='notepad.exe' title='uia-m3-note.txt*' />" }, targetAppOptions: new TargetAppOptions { OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.Always, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Always }))
            {
                // メモ帳を最大化する
                app1.WindowOperation(target: new TargetAnchorableModel { PartialSelector = "<wnd app='notepad.exe' title='uia-m3-note.txt*' />", ScopeSelector = "<wnd app='notepad.exe' title='uia-m3-note.txt*' />", SearchSteps = UiPath.UIAutomationNext.Enums.TargetSearchSteps.Selector }, windowOperationOptions: new WindowOperationOptions { Operation = UiPath.UIAutomationNext.Enums.NWindowOperationType.Maximize });
                Log(message: "maximized", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
