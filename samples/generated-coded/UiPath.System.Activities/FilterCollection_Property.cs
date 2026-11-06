using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FilterCollection_Property）から生成。手で直さず IR を直す
    public class FilterCollection_Property : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<FileInfo> files = new List<FileInfo>() { new FileInfo("a.txt"), new FileInfo("b.log"), new FileInfo("c.txt") };
            List<FileInfo> txtFiles = default;
            // 要素のプロパティで絞る（CurrentItem.プロパティ名）
            // FilterCollection はCoded API が無い（Coded API なし（ISystemService に FilterCollection が無い。公開の CollectionFilterSettingsExtensions.ApplyFilters は ActivityContext を取るので Coded から呼べない。C# では LINQ で書く））ので XAML 経由（coded/_xaml/FilterCollection_Property_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FilterCollection_Property_1.xaml", new Dictionary<string, object> { ["files"] = files, ["txtFiles"] = txtFiles });
            txtFiles = (List<FileInfo>)__xaml1["txtFiles"];
            Log(message: "txt=" + String.Join(",", txtFiles.Select(f => f.Name)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
