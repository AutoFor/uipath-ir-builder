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
    // tools/ir/gen-coded.ts で IR（NWindowOperation_Full）から生成。手で直さず IR を直す
    public class NWindowOperation_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String notePath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uia-m3-note.txt");
            // メモ帳に開かせるファイルを書く
            system.WriteTextFile(text: "uia-m3", file: LocalResource.FromPath(notePath));
            // メモ帳を開く
            using (var app1 = uiAutomation.Open(targetApp: new TargetAppModel { FilePath = "C:/Windows/System32/notepad.exe", Arguments = notePath, Selector = "<wnd app='notepad.exe' title='uia-m3-note.txt*' />" }, targetAppOptions: new TargetAppOptions { AttachMode = UiPath.UIAutomationNext.Enums.NAppAttachMode.ByInstance, OpenMode = UiPath.UIAutomationNext.Enums.NAppOpenMode.Always, CloseMode = UiPath.UIAutomationNext.Enums.NAppCloseMode.Always, HealingAgentBehavior = UiPath.UIAutomationNext.Enums.NChildHealingAgentBehavior.Job }))
            {
                // メモ帳を動かして大きさを変える（全部入り）
                app1.WindowOperation(target: new TargetAnchorableModel { PartialSelector = "<wnd app='notepad.exe' title='uia-m3-note.txt*' />", ScopeSelector = "<wnd app='notepad.exe' title='uia-m3-note.txt*' />", SearchSteps = UiPath.UIAutomationNext.Enums.TargetSearchSteps.Selector }, windowOperationOptions: new WindowOperationOptions { Operation = UiPath.UIAutomationNext.Enums.NWindowOperationType.Move, X = 100, Y = 100, Width = 700, Height = 500 });
                Log(message: "moved", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
