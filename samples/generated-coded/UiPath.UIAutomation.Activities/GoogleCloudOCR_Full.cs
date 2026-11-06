using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GoogleCloudOCR_Full）から生成。手で直さず IR を直す
    public class GoogleCloudOCR_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Image img = default;
            String txt = default;
            IEnumerable<KeyValuePair<Rectangle,String>> words = default;
            OcrActivityResult ocrOut = default;
            // GoogleCloudOCR（全部入り）
            // GoogleCloudOCR はCoded API が無い（Coded API なし（OCR エンジン（クラウド）。Coded の API に OCR のエンジンのアクティビティは無い））ので XAML 経由（coded/_xaml/GoogleCloudOCR_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GoogleCloudOCR_Full_1.xaml", new Dictionary<string, object> { ["img"] = img, ["txt"] = txt, ["words"] = words, ["ocrOut"] = ocrOut });
            txt = (String)__xaml1["txt"];
            words = (IEnumerable<KeyValuePair<Rectangle,String>>)__xaml1["words"];
            ocrOut = (OcrActivityResult)__xaml1["ocrOut"];
            Log(message: "OCR: " + txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
