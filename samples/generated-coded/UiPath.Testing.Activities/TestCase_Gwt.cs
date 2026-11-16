using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TestCase_Gwt）から生成。手で直さず IR を直す
    public class TestCase_Gwt : CodedWorkflow
    {
        [TestCase]
        public void Execute()
        {
            Int32 price = default;
            Int32 quantity = default;
            Int32 total = default;
            // Given
            price = 120;
            quantity = 3;
            // When
            total = price * quantity;
            // Then
            // 合計が 360 か
            _ = testing.VerifyExpressionWithOperator(total, UiPath.Testing.Comparison.Equality, 360, null, true, null, false, false);
            Log(message: "total=" + total.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
