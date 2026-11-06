using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FilterCollection_Min）から生成。手で直さず IR を直す
    public class FilterCollection_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<Int32> numbers = new List<Int32>() { 1, 5, 8, 12 };
            List<Int32> filtered = default;
            // FilterCollection はCoded API が無い（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く））ので XAML 経由（coded/_xaml/FilterCollection_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FilterCollection_Min_1.xaml", new Dictionary<string, object> { ["numbers"] = numbers, ["filtered"] = filtered });
            filtered = (List<Int32>)__xaml1["filtered"];
            Log(message: "filtered=" + String.Join(",", filtered), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "source=" + String.Join(",", numbers), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
