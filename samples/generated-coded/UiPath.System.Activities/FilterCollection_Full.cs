using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FilterCollection_Full）から生成。手で直さず IR を直す
    public class FilterCollection_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<Int32> numbers = new List<Int32>() { 1, 5, 8, 12 };
            Int32 threshold = 10;
            List<String> words = new List<String>() { "apple", "Banana", "cherry", "date" };
            List<Int32> inPlace = new List<Int32>() { 1, 2, 3 };
            List<Int32> andResult = default;
            List<Int32> rangeResult = default;
            List<String> orResult = default;
            // 数値を And で絞る（以上、式の値以下、等しくない）
            // FilterCollection はCoded API が無い（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く））ので XAML 経由（coded/_xaml/FilterCollection_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FilterCollection_Full_1.xaml", new Dictionary<string, object> { ["numbers"] = numbers, ["andResult"] = andResult, ["threshold"] = threshold });
            andResult = (List<Int32>)__xaml1["andResult"];
            Log(message: "and=" + String.Join(",", andResult), level: UiPath.CodedWorkflows.LogLevel.Info);
            // より大きい、より小さい
            // FilterCollection はCoded API が無い（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く））ので XAML 経由（coded/_xaml/FilterCollection_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/FilterCollection_Full_2.xaml", new Dictionary<string, object> { ["numbers"] = numbers, ["rangeResult"] = rangeResult });
            rangeResult = (List<Int32>)__xaml2["rangeResult"];
            Log(message: "range=" + String.Join(",", rangeResult), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 文字列を Or で探して取り除く
            // FilterCollection はCoded API が無い（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く））ので XAML 経由（coded/_xaml/FilterCollection_Full_3.xaml）
            var __xaml3 = RunWorkflow("coded/_xaml/FilterCollection_Full_3.xaml", new Dictionary<string, object> { ["words"] = words, ["orResult"] = orResult });
            orResult = (List<String>)__xaml3["orResult"];
            Log(message: "or=" + String.Join(",", orResult), level: UiPath.CodedWorkflows.LogLevel.Info);
            // Result なし（元の一覧を書き換える）
            // FilterCollection はCoded API が無い（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く））ので XAML 経由（coded/_xaml/FilterCollection_Full_4.xaml）
            RunWorkflow("coded/_xaml/FilterCollection_Full_4.xaml", new Dictionary<string, object> { ["inPlace"] = inPlace });
            Log(message: "inPlace=" + String.Join(",", inPlace), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
