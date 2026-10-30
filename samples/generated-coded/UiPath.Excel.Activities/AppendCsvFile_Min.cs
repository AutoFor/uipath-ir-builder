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
    // tools/ir/gen-coded.ts で IR（AppendCsvFile_Min）から生成。手で直さず IR を直す
    public class AppendCsvFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            String txt = default;
            // Alice と Bob の表を作る
            {
                var __ds = new DataSet();
                __ds.ReadXml(new StringReader("<NewDataSet>\n  <xs:schema id=\"NewDataSet\" xmlns=\"\" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" xmlns:msdata=\"urn:schemas-microsoft-com:xml-msdata\"><xs:element name=\"NewDataSet\" msdata:IsDataSet=\"true\" msdata:MainDataTable=\"TableName\" msdata:UseCurrentLocale=\"true\"><xs:complexType><xs:choice minOccurs=\"0\" maxOccurs=\"unbounded\"><xs:element name=\"TableName\"><xs:complexType><xs:sequence><xs:element name=\"Name\" minOccurs=\"0\"><xs:simpleType><xs:restriction base=\"xs:string\"><xs:maxLength value=\"100\" /></xs:restriction></xs:simpleType></xs:element><xs:element name=\"Age\" type=\"xs:int\" minOccurs=\"0\" /></xs:sequence></xs:complexType></xs:element></xs:choice></xs:complexType></xs:element></xs:schema>\n  <TableName><Name>Alice</Name><Age>30</Age></TableName>\n  <TableName><Name>Bob</Name><Age>25</Age></TableName>\n</NewDataSet>"));
                dt = __ds.Tables[0];
            }
            // 先に書く
            ExcelOperations.WriteCsvFile(filePath: "output\\AppendCsvFile_Min.csv", data: dt, delimiter: UiPath.CSV.DelimitatorOptions.Comma, addHeaders: true, encodingStr: null, shouldQuote: true);
            ExcelOperations.AppendCsvFile(filePath: "output\\AppendCsvFile_Min.csv", data: dt, delimiter: UiPath.CSV.DelimitatorOptions.Comma, encodingStr: null);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\AppendCsvFile_Min.csv"));
            Log(message: Convert.ToString("CSV: " + txt.Replace("\r", "").Replace("\n", "|")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
