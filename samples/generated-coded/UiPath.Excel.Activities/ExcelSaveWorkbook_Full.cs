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
    // tools/ir/gen-coded.ts で IR（ExcelSaveWorkbook_Full）から生成。手で直さず IR を直す
    public class ExcelSaveWorkbook_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelSaveWorkbook_Full.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelSaveWorkbook_Full.xlsx", CreateNew = true }))
            {
                ExcelWorkbookScope.WriteCell(sheetName: "Sheet1", cell: "E1", text: "保存した");
                // ブックを保存する
                // ExcelSaveWorkbook はCoded API が無い（Coded API なし（IWorkHandle に保存のメソッドは無い。SaveExcelFile は IWorkbookQuickHandle 用でモダンの SaveExcelFileX））ので XAML 経由（coded/_activities/ExcelSaveWorkbook.xaml）
                RunWorkflow("coded/_activities/ExcelSaveWorkbook.xaml", null);
            }
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelSaveWorkbook_Full.xlsx", CreateNew = true }))
            {
                v = (Object)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "E1", preserveFormat: false), typeof(Object));
            }
            Log(message: "E1: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
