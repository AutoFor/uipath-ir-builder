using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GoogleCloudOCR_Min）から生成。手で直さず IR を直す
    public class GoogleCloudOCR_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Image img = default;
            // GoogleCloudOCR（最小）
            // GoogleCloudOCR はCoded API が無い（Coded API なし（OCR エンジン（クラウド）。Coded の API に OCR のエンジンのアクティビティは無い））ので XAML 経由（coded/_activities/GoogleCloudOCR_f33195.xaml）
            RunWorkflow("coded/_activities/GoogleCloudOCR_f33195.xaml", new Dictionary<string, object> { ["in_ApiKey"] = "DUMMY-KEY-NOT-USED", ["in_Image"] = img });
        }
    }
}
