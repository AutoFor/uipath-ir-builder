using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetCurrentJobInfo_Full）から生成。手で直さず IR を直す
    public class GetCurrentJobInfo_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            CurrentJobInfo info = default;
            // 今のジョブの情報
            // GetCurrentJobInfo はCoded API が無い（Coded API なし（ISystemService に GetCurrentJobInfo が無い。docs の Notes には「Coded 対応」とあるが、26.10.0 のサービス API には出ていない））ので XAML 経由（coded/_activities/GetCurrentJobInfo_87628c.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetCurrentJobInfo_87628c.xaml", null);
            info = (UiPath.Core.Activities.CurrentJobInfo)__xaml1["out_Result"];
            Log(message: "ジョブ情報あり: " + (info != null).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
