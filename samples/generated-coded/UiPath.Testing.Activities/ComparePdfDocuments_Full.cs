using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ComparePdfDocuments_Full）から生成。手で直さず IR を直す
    public class ComparePdfDocuments_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource a = default;
            ILocalResource b = default;
            UiPath.Testing.Activities.Models.ComparisonRule rule = default;
            Boolean withRule = default;
            Boolean plain = default;
            IEnumerable<UiPath.Testing.Activities.Models.Difference> diffs = default;
            // 元の PDF を書く
            system.WriteTextFile(text: "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 45 >>\nstream\nBT /F1 14 Tf 72 760 Td (Order 123 done) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000336 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n406\n%%EOF\n", file: LocalResource.FromPath("output\\uta-base.pdf"), encoding: "us-ascii");
            // 数字だけ違う PDF を書く
            system.WriteTextFile(text: "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 45 >>\nstream\nBT /F1 14 Tf 72 760 Td (Order 789 done) Tj ET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000336 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n406\n%%EOF\n", file: LocalResource.FromPath("output\\uta-target.pdf"), encoding: "us-ascii");
            a = system.PathExists("output\\uta-base.pdf", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\uta-base.pdf") : null;
            b = system.PathExists("output\\uta-target.pdf", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\uta-target.pdf") : null;
            // 数字を無視する規則
            // CreateComparisonRule は対応表が無いので XAML 経由（coded/_activities/CreateComparisonRule_450c24.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateComparisonRule_450c24.xaml", new Dictionary<string, object> { ["in_Pattern"] = "\\d+", ["in_RuleName"] = "numbers", ["in_UsePlaceholder"] = true });
            rule = (UiPath.Testing.Activities.Models.ComparisonRule)__xaml1["out_ComparisonRule"];
            // 規則つきで比べる
            // ComparePdfDocuments は対応表が無いので XAML 経由（coded/_activities/ComparePdfDocuments_386fb6.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/ComparePdfDocuments_386fb6.xaml", new Dictionary<string, object> { ["in_BaselinePath"] = a, ["in_ContinueOnFailure"] = true, ["in_IgnoreIdenticalItems"] = true, ["in_IgnoreImagesLocation"] = false, ["in_IncludeImages"] = false, ["in_OutputFolderPath"] = "output", ["in_RulesList"] = new List<UiPath.Testing.Activities.Models.ComparisonRule> { rule }, ["in_TargetPath"] = b });
            withRule = (System.Boolean)__xaml2["out_Result"];
            // 規則なしで比べる
            // ComparePdfDocuments は対応表が無いので XAML 経由（coded/_activities/ComparePdfDocuments_55944c.xaml）
            var __xaml3 = RunWorkflow("coded/_activities/ComparePdfDocuments_55944c.xaml", new Dictionary<string, object> { ["in_BaselinePath"] = a, ["in_ContinueOnFailure"] = true, ["in_IncludeImages"] = false, ["in_OutputFolderPath"] = "output", ["in_TargetPath"] = b });
            diffs = (System.Collections.Generic.IEnumerable<UiPath.Testing.Activities.Models.Difference>)__xaml3["out_Differences"];
            plain = (System.Boolean)__xaml3["out_Result"];
            Log(message: Convert.ToString("withRule=" + withRule.ToString() + " plain=" + plain.ToString() + " diffs=" + diffs.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
