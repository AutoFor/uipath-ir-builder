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
    // tools/ir/gen-coded.ts で IR（CreateTableX_Full）から生成。手で直さず IR を直す
    public class CreateTableX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String tableName = default;
            DataTable dt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\CreateTableX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CreateTableX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                // 名簿テーブルを作る
                tableName = Excel.Sheet["Sheet1"].Range["A1:C4"].CreateTable(hasHeaders: true, replaceExisting: true, tableName: "PeopleTable");
                Log(message: "テーブル名: " + tableName, level: UiPath.CodedWorkflows.LogLevel.Info);
                dt = Excel.Table["PeopleTable"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
                Log(message: "テーブルの行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                Log(message: "2 行目: " + dt.Rows[1]["Name"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
