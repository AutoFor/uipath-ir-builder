using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ComparePdfDocuments_Min）から生成。手で直さず IR を直す
    public class ComparePdfDocuments_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource a = default;
            ILocalResource b = default;
            Boolean same = default;
            // 比べる PDF を書く
            system.WriteTextFile(text: "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 45 >>\nstream\nBT /F1 14 Tf 72 760 Td (Order 123 done) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000336 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n406\n%%EOF\n", file: LocalResource.FromPath("output\\uta-base.pdf"), encoding: "us-ascii");
            // 同じ中身の PDF を書く
            system.WriteTextFile(text: "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 45 >>\nstream\nBT /F1 14 Tf 72 760 Td (Order 123 done) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000336 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n406\n%%EOF\n", file: LocalResource.FromPath("output\\uta-base2.pdf"), encoding: "us-ascii");
            a = system.PathExists("output\\uta-base.pdf", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\uta-base.pdf") : null;
            b = system.PathExists("output\\uta-base2.pdf", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\uta-base2.pdf") : null;
            // PDF を比べる
            // ComparePdfDocuments は対応表が無いので XAML 経由（coded/_activities/ComparePdfDocuments_143f60.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ComparePdfDocuments_143f60.xaml", new Dictionary<string, object> { ["in_BaselinePath"] = a, ["in_OutputFolderPath"] = "output", ["in_TargetPath"] = b });
            same = (System.Boolean)__xaml1["out_Result"];
            Log(message: Convert.ToString("same=" + same.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
