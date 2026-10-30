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
    // tools/ir/gen-coded.ts で IR（ExcelApplicationCard_SecureString）から生成。手で直さず IR を直す
    public class ExcelApplicationCard_SecureString : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            System.Security.SecureString pw = new System.Net.NetworkCredential("", "open").SecurePassword;
            System.Security.SecureString editPw = new System.Net.NetworkCredential("", "edit").SecurePassword;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Protected.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, Password = new System.Net.NetworkCredential(string.Empty, pw).Password, EditPassword = new System.Net.NetworkCredential(string.Empty, editPw).Password }))
            {
                name = (String)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(String));
            }
            Log(message: "A1: " + name, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
