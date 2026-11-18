using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractDocumentDataWithDocumentData_Min）から生成。手で直さず IR を直す
    public class ExtractDocumentDataWithDocumentData_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute(IResource in_Invoice)
        {
            UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.IDocumentData<UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.DictionaryData> docData = default;
            String json = default;
            String total = default;
            // ExtractDocumentDataWithDocumentData は対応表が無いので XAML 経由（coded/_xaml/ExtractDocumentDataWithDocumentData_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExtractDocumentDataWithDocumentData_Min_1.xaml", new Dictionary<string, object> { ["in_Invoice"] = in_Invoice, ["docData"] = docData });
            docData = (UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.IDocumentData<UiPath.IntelligentOCR.StudioWeb.Activities.DataExtraction.DictionaryData>)__xaml1["docData"];
            json = String.Join(" | ", docData.Data.GetFields().Select(f => f.FieldName + "=" + (f.Values != null && f.Values.Length > 0 ? f.Values(0).Value : "")));
            Log(message: json);
            total = docData.Data.GetFieldValue("Total Amount").Value;
            Log(message: "TOTAL=" + total);
        }
    }
}
