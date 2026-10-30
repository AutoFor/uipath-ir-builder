using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BuildDataTable_Full）から生成。手で直さず IR を直す
    public class BuildDataTable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // 表を作る
            {
                var __ds = new DataSet();
                __ds.ReadXml(new StringReader("<NewDataSet>\n  <xs:schema id=\"NewDataSet\" xmlns=\"\" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" xmlns:msdata=\"urn:schemas-microsoft-com:xml-msdata\"><xs:element name=\"NewDataSet\" msdata:IsDataSet=\"true\" msdata:MainDataTable=\"TableName\" msdata:UseCurrentLocale=\"true\"><xs:complexType><xs:choice minOccurs=\"0\" maxOccurs=\"unbounded\"><xs:element name=\"TableName\"><xs:complexType><xs:sequence><xs:element name=\"Name\" minOccurs=\"0\"><xs:simpleType><xs:restriction base=\"xs:string\"><xs:maxLength value=\"50\" /></xs:restriction></xs:simpleType></xs:element><xs:element name=\"Age\" type=\"xs:int\" minOccurs=\"0\" /><xs:element name=\"Active\" type=\"xs:boolean\" minOccurs=\"0\" /><xs:element name=\"Score\" type=\"xs:double\" minOccurs=\"0\" /></xs:sequence></xs:complexType></xs:element></xs:choice></xs:complexType></xs:element></xs:schema>\n  <TableName><Name>Alice</Name><Age>30</Age><Active>true</Active><Score>1.5</Score></TableName>\n  <TableName><Name>Bob</Name><Age>25</Age><Active>false</Active><Score>2.25</Score></TableName>\n  <TableName><Name>Carol</Name><Age>35</Age><Active>true</Active><Score>3</Score></TableName>\n</NewDataSet>"));
                dt = __ds.Tables[0];
            }
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns=" + dt.Columns.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Active.Type=" + dt.Columns["Active"].DataType.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Score.Type=" + dt.Columns["Score"].DataType.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Name.MaxLength=" + dt.Columns["Name"].MaxLength.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("active0=" + dt.Rows[0]["Active"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("active1=" + dt.Rows[1]["Active"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("score1=" + dt.Rows[1]["Score"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
