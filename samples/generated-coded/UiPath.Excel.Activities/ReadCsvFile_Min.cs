using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Excel.Activities.API;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReadCsvFile_Min）から生成。手で直さず IR を直す
    public class ReadCsvFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            String txt = default;
            // CSV を書く
            system.WriteTextFile(text: "Name,Age\nAlice,30\nBob,25", file: LocalResource.FromPath("output\\ReadCsvFile_Min.csv"));
            dt = ExcelOperations.ReadCsvFile(filePath: "output\\ReadCsvFile_Min.csv", delimiter: UiPath.CSV.DelimitatorOptions.Comma, includeColumnNames: true, encodingStr: null, ignoreQuotes: false);
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns=" + dt.Columns.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("first=" + dt.Rows[0][0].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("col0=" + dt.Columns[0].ColumnName), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
