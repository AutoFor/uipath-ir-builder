using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GoogleOCR_Full）から生成。手で直さず IR を直す
    public class GoogleOCR_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Image img = default;
            String txt = default;
            IEnumerable<KeyValuePair<Rectangle,String>> words = default;
            OcrActivityResult ocrOut = default;
            // GoogleOCR（全部入り）
            // GoogleOCR はCoded API が無い（Coded API なし（OCR エンジン（クラウド）。Coded の API に OCR のエンジンのアクティビティは無い））ので XAML 経由（coded/_activities/GoogleOCR_6a2ce3.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GoogleOCR_6a2ce3.xaml", new Dictionary<string, object> { ["in_AllowedCharacters"] = "ABC123", ["in_DeniedCharacters"] = "xyz", ["in_Image"] = img, ["in_Invert"] = true, ["in_Language"] = "jpn", ["in_PredictionId"] = "uia-c5", ["in_Scale"] = 1.5 });
            ocrOut = (UiPath.OCR.Contracts.OcrActivityResult)__xaml1["out_Output"];
            words = (System.Collections.Generic.IEnumerable<System.Collections.Generic.KeyValuePair<System.Drawing.Rectangle, System.String>>)__xaml1["out_Result"];
            txt = (System.String)__xaml1["out_Text"];
            Log(message: "OCR: " + txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
