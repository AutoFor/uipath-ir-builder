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
    // tools/ir/gen-coded.ts で IR（TextToColumnsX_Fixedwidth）から生成。手で直さず IR を直す
    public class TextToColumnsX_Fixedwidth : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v1 = default;
            Object v2 = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\TextToColumnsX_Fixedwidth.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Cell["A1"].WriteCell(value: "abc123");
                Excel.Sheet["Sheet1"].Cell["A2"].WriteCell(value: "def456");
                // 3文字ずつ分ける
                Excel.Sheet["Sheet1"].Range["A1:A2"].TextToColumns(destRange: Excel.Sheet["Sheet1"].Range["C1"], options: new TextToColumnsOptions { ColumnsDelimiters = (true ? UiPath.Excel.TextToColumnsDelimiters.Tab : UiPath.Excel.TextToColumnsDelimiters.None) | (true ? UiPath.Excel.TextToColumnsDelimiters.Semicolon : UiPath.Excel.TextToColumnsDelimiters.None) | (true ? UiPath.Excel.TextToColumnsDelimiters.Comma : UiPath.Excel.TextToColumnsDelimiters.None) | (true ? UiPath.Excel.TextToColumnsDelimiters.Space : UiPath.Excel.TextToColumnsDelimiters.None) | (false ? UiPath.Excel.TextToColumnsDelimiters.Other : UiPath.Excel.TextToColumnsDelimiters.None), ConsecutiveOperatorsAsOne = true, NumberOfCharactersPerColumn = 3, ParsingType = UiPath.Excel.TextToColumnsParsingType.FixedWidth, SplitByLineBreak = false, TextQualifier = UiPath.Excel.TextToColumnsTextQualifier.None });
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["C2"].ReadCellValue(getFormattedText: true), typeof(Object));
                v2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["D2"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "C2=" + Convert.ToString(v1) + " D2=" + Convert.ToString(v2), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
