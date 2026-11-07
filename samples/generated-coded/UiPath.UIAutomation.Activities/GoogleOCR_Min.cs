using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GoogleOCR_Min）から生成。手で直さず IR を直す
    public class GoogleOCR_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Drawing.Image img = default;
            // GoogleOCR（最小）
            // GoogleOCR はCoded API が無い（Coded API なし（OCR エンジン（クラウド）。Coded の API に OCR のエンジンのアクティビティは無い））ので XAML 経由（coded/_activities/GoogleOCR.xaml）
            RunWorkflow("coded/_activities/GoogleOCR.xaml", new Dictionary<string, object> { ["in_Image"] = img });
        }
    }
}
