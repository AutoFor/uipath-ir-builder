using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Office365ApplicationScope_Min）から生成。手で直さず IR を直す
    public class Office365ApplicationScope_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String tenant = "contoso.onmicrosoft.com";
            // Office365ApplicationScope は対応表が無いので XAML 経由（coded/_xaml/Office365ApplicationScope_Min_1.xaml）
            RunWorkflow("coded/_xaml/Office365ApplicationScope_Min_1.xaml", new Dictionary<string, object> { ["tenant"] = tenant });
        }
    }
}
