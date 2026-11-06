using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SendEmailNotification_Min）から生成。手で直さず IR を直す
    public class SendEmailNotification_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> toList = new List<String>() { "ir-to@example.com" };
            List<String> ccList = new List<String>() { "ir-cc@example.com" };
            // SendEmailNotification はCoded API が無い（Coded API なし（ISystemService に SendEmailNotification が無い））ので XAML 経由（coded/_activities/SendEmailNotification.xaml）
            RunWorkflow("coded/_activities/SendEmailNotification.xaml", new Dictionary<string, object> { ["in_Body"] = "本文です", ["in_Recipients"] = toList, ["in_Subject"] = "IR テスト" });
            Log(message: "通知メールを送った", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
