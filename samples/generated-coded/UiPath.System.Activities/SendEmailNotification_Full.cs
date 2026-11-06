using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SendEmailNotification_Full）から生成。手で直さず IR を直す
    public class SendEmailNotification_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> toList = new List<String>() { "ir-to@example.com" };
            List<String> ccList = new List<String>() { "ir-cc@example.com" };
            // 通知メールを送る
            // SendEmailNotification はCoded API が無い（Coded API なし（ISystemService に SendEmailNotification が無い））ので XAML 経由（coded/_activities/SendEmailNotification_fde92b.xaml）
            RunWorkflow("coded/_activities/SendEmailNotification_fde92b.xaml", new Dictionary<string, object> { ["in_Body"] = "本文です\n二行目", ["in_Cc"] = ccList, ["in_ContinueOnError"] = false, ["in_Recipients"] = toList, ["in_Subject"] = "IR テスト（全部入り）", ["in_TimeoutMS"] = 30000 });
            Log(message: "通知メールを送った", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
