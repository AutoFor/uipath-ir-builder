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
            // SendMail は対応表が無いので XAML 経由（coded/_xaml/SendMail_Min_1.xaml）
            RunWorkflow("coded/_xaml/SendMail_Min_1.xaml", new Dictionary<string, object> { ["mailTo"] = mailTo });
            Log(message: "送った: " + mailTo, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
