using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TestCase_Data）から生成。手で直さず IR を直す
    public class TestCase_Data : CodedWorkflow
    {
        [TestCase]
        public void Execute(Int32 price, Int32 quantity, Int32 expected)
        {
            Int32 total = default;
            // Given
            Log(message: "price=" + price.ToString() + " quantity=" + quantity.ToString());
            // When
            total = price * quantity;
            // Then
            // 合計が期待どおりか
            _ = testing.VerifyExpressionWithOperator(total, UiPath.Testing.Comparison.Equality, expected, null, true, null, false, false);
            Log(message: "total=" + total.ToString());
        }
    }
}
