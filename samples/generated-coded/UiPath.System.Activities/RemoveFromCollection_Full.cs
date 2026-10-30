using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RemoveFromCollection_Full）から生成。手で直さず IR を直す
    public class RemoveFromCollection_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>() { "a", "b", "c" };
            List<String> dups = new List<String>() { "x", "y", "x" };
            List<String> all = new List<String>() { "p", "q" };
            // 位置で消す
            ((IList<String>)items).RemoveAt(0);
            Log(message: Convert.ToString(String.Join(",", items)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 最初の一致を消す
            dups.Remove("x");
            Log(message: Convert.ToString(String.Join(",", dups)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 全部消す
            if (true) all = new List<String>();
            Log(message: "count=" + all.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
