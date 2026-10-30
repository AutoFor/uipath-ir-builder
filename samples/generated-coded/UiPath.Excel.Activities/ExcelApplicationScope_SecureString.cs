using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Excel;
using UiPath.Excel.Activities.API;
using UiPath.Excel.Activities.API.Models;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExcelApplicationScope_SecureString）から生成。手で直さず IR を直す
    public class ExcelApplicationScope_SecureString : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            System.Security.SecureString pw = new System.Net.NetworkCredential("", "open").SecurePassword;
            System.Security.SecureString editPw = new System.Net.NetworkCredential("", "edit").SecurePassword;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Protected.xlsx", CreateNew = true, Password = new System.Net.NetworkCredential(string.Empty, pw).Password }))
            {
                v = (String)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "A1", preserveFormat: false), typeof(String));
            }
            Log(message: "A1: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
