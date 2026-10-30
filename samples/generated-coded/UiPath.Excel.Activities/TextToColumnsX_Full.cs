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
    // tools/ir/gen-coded.ts で IR（TextToColumnsX_Full）から生成。手で直さず IR を直す
    public class TextToColumnsX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v1 = default;
            Object v2 = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\TextToColumnsX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Cell["A1"].WriteCell(value: "太郎,30|東京");
                Excel.Sheet["Sheet1"].Cell["A2"].WriteCell(value: "花子,25|大阪");
                // カンマと | で分ける
                Excel.Sheet["Sheet1"].Range["A1:A2"].TextToColumns(destRange: Excel.Sheet["Sheet1"].Range["C1"], options: new TextToColumnsOptions { ColumnsDelimiters = (false ? UiPath.Excel.TextToColumnsDelimiters.Tab : UiPath.Excel.TextToColumnsDelimiters.None) | (false ? UiPath.Excel.TextToColumnsDelimiters.Semicolon : UiPath.Excel.TextToColumnsDelimiters.None) | (true ? UiPath.Excel.TextToColumnsDelimiters.Comma : UiPath.Excel.TextToColumnsDelimiters.None) | (false ? UiPath.Excel.TextToColumnsDelimiters.Space : UiPath.Excel.TextToColumnsDelimiters.None) | (true ? UiPath.Excel.TextToColumnsDelimiters.Other : UiPath.Excel.TextToColumnsDelimiters.None), ConsecutiveOperatorsAsOne = true, OtherSeparator = '|', ParsingType = UiPath.Excel.TextToColumnsParsingType.Delimited, SplitByLineBreak = false, TextQualifier = UiPath.Excel.TextToColumnsTextQualifier.DoubleQuote });
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["C2"].ReadCellValue(getFormattedText: true), typeof(Object));
                v2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["E2"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "C2=" + Convert.ToString(v1) + " E2=" + Convert.ToString(v2), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
