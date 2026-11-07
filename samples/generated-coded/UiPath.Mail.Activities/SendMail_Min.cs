using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SendMail_Min）から生成。手で直さず IR を直す
    public class SendMail_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String mailTo = "someone@example.com";
            // SendMail は対応表が無いので XAML 経由（coded/_activities/SendMail_d9fbba.xaml）
            RunWorkflow("coded/_activities/SendMail_d9fbba.xaml", new Dictionary<string, object> { ["in_Body"] = "本文 " + mailTo, ["in_Email"] = "robot@example.com", ["in_Password"] = "dummy", ["in_Port"] = 587, ["in_Server"] = "smtp.example.com", ["in_Subject"] = "件名", ["in_To"] = mailTo });
            Log(message: "送った: " + mailTo, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
