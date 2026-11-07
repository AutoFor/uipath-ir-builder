using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MicrosoftAzureComputerVisionOCR_Min）から生成。手で直さず IR を直す
    public class MicrosoftAzureComputerVisionOCR_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Drawing.Image img = default;
            // MicrosoftAzureComputerVisionOCR（最小）
            // MicrosoftAzureComputerVisionOCR はCoded API が無い（Coded API なし（OCR エンジン（クラウド）。Coded の API に OCR のエンジンのアクティビティは無い））ので XAML 経由（coded/_activities/MicrosoftAzureComputerVisionOCR_858847.xaml）
            RunWorkflow("coded/_activities/MicrosoftAzureComputerVisionOCR_858847.xaml", new Dictionary<string, object> { ["in_ApiKey"] = "DUMMY-KEY-NOT-USED", ["in_Endpoint"] = "https://example.invalid/", ["in_Image"] = img });
        }
    }
}
