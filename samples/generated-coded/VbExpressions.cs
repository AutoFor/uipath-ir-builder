using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VbExpressions）から生成。手で直さず IR を直す
    public class VbExpressions : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String s = "a,b";
            Int32 n = 3;
            List<String> items = new List<String>() { "a", "bb", "ccc" };
            Object o = "text";
            DataTable dt = new DataTable();
            dt.Columns.Add("A").DefaultValue = "d";
            dt.Rows.Add("x1").RowError = "";
            Log(message: "vbCr=" + ("a" + "\r" + "b").Length.ToString());
            Log(message: "vbLf=" + ("a" + "\n" + "b").IndexOf("\n").ToString());
            Log(message: "vbCrLf=" + ("a" + "\r\n").Length.ToString());
            Log(message: "vbTab=" + ("a" + "\t").Length.ToString());
            Log(message: "vbNewLine=" + (Environment.NewLine == Environment.NewLine).ToString());
            Log(message: "ControlChars=" + ("a" + Microsoft.VisualBasic.ControlChars.Tab).Length.ToString());
            Log(message: "Left=" + Microsoft.VisualBasic.Strings.Left(s, 1) + Microsoft.VisualBasic.Strings.Mid(s, 3, 1) + Microsoft.VisualBasic.Strings.Right(s, 1) + Microsoft.VisualBasic.Strings.UCase(s) + Microsoft.VisualBasic.Strings.Len(s).ToString() + Microsoft.VisualBasic.Strings.InStr(s, ",").ToString());
            Log(message: "IsNumeric=" + Microsoft.VisualBasic.Information.IsNumeric("12").ToString());
            Log(message: "Split=" + s.Split(',')[1]);
            Log(message: "If=" + (n > 1 ? "big" : "small"));
            Log(message: "IfNull=" + (((String)(null)) ?? "dflt"));
            Log(message: "IIf=" + (n > 5 ? "big" : "small").ToString());
            Log(message: "Not=" + (!(s == "x")).ToString() + (!(o == null)).ToString());
            Log(message: "Div=" + ((double)7 / 2).ToString() + " " + ((double)n / 2).ToString());
            Log(message: "Count=" + items.Where(x => x != "a").Count().ToString());
            Log(message: "Select=" + String.Join("|", items.Select(x => x.ToUpper())));
            Log(message: "Any=" + items.Any((String x) => x.Length == 3).ToString());
            Log(message: "Cast=" + String.Join("|", dt.Rows.Cast<DataRow>().Select(r => r["A"].ToString())));
            Log(message: "Index=" + dt.Rows[0]["A"].ToString() + dt.Rows[0]["A"].ToString() + dt.Rows[0].Field<String>("A"));
            Log(message: "GetType=" + new DataColumn("M", typeof(String)).DataType.Name);
            Log(message: "TypeOf=" + ((o is String)).ToString());
            Log(message: "With=" + (new System.Diagnostics.ProcessStartInfo("p") { Arguments = "q", CreateNoWindow = true }).Arguments);
            Log(message: "Array=" + new[] { "a", "b" }.Length.ToString());
            Log(message: "Date=" + new DateTime(2020, 1, 2).Day.ToString() + (DateTime.Now.Year > 2000).ToString() + (DateTime.Today <= DateTime.Now).ToString() + DateTime.MaxValue.Year.ToString());
            Log(message: "Hex=" + (0x10).ToString());
            Log(message: "Parse=" + (int.Parse("5") * 2).ToString() + Convert.ToInt32("5").ToString() + Convert.ToString(5));
            Log(message: "Named=" + s.Split(new[] { ',' }, count: 1)[0]);
        }
    }
}
