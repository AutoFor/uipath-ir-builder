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
    // tools/ir/gen-coded.ts で IR（CreateTableX_Min）から生成。手で直さず IR を直す
    public class CreateTableX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String tableName = default;
            DataTable dt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\CreateTableX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CreateTableX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                tableName = Excel.Sheet["Sheet1"].Range["A1:C4"].CreateTable(hasHeaders: true, replaceExisting: false, tableName: null);
                Log(message: "テーブル名: " + tableName, level: UiPath.CodedWorkflows.LogLevel.Info);
                dt = Excel.Table[tableName].ReadRange(hasHeaders: true, visibleRowsOnly: true);
                Log(message: "テーブルの行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
