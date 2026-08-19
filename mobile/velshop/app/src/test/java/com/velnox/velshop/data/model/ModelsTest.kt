package com.velnox.velshop.data.model

import org.junit.Assert.*
import org.junit.Test

class ProductTest {

    @Test
    fun `priceFormatted formats THB correctly`() {
        val product = Product(price = 123.456)
        assertEquals("฿123.46", product.priceFormatted)
    }

    @Test
    fun `priceFormatted handles zero`() {
        val product = Product(price = 0.0)
        assertEquals("฿0.00", product.priceFormatted)
    }

    @Test
    fun `availableStock is stock minus reserved`() {
        val product = Product(stock = 10, reserved = 3)
        assertEquals(7, product.availableStock)
    }

    @Test
    fun `isAvailable checks status and stock`() {
        val active = Product(status = "ACTIVE", stock = 5, reserved = 0)
        assertTrue(active.isAvailable)

        val outOfStock = Product(status = "ACTIVE", stock = 0, reserved = 0)
        assertFalse(outOfStock.isAvailable)

        val inactive = Product(status = "DRAFT", stock = 5, reserved = 0)
        assertFalse(inactive.isAvailable)
    }

    @Test
    fun `primaryImage returns first image`() {
        val product = Product(images = listOf("a.jpg", "b.jpg"))
        assertEquals("a.jpg", product.primaryImage)
    }

    @Test
    fun `primaryImage returns null for empty images`() {
        val product = Product(images = emptyList())
        assertNull(product.primaryImage)
    }
}

class ProductVariantTest {

    @Test
    fun `effectivePrice uses variant price when set`() {
        val variant = ProductVariant(price = 99.0)
        assertEquals(99.0, variant.effectivePrice(50.0), 0.01)
    }

    @Test
    fun `effectivePrice falls back to product price`() {
        val variant = ProductVariant(price = null)
        assertEquals(50.0, variant.effectivePrice(50.0), 0.01)
    }

    @Test
    fun `availableStock is stock minus reserved`() {
        val variant = ProductVariant(stock = 10, reserved = 4)
        assertEquals(6, variant.availableStock)
    }
}

class LocalizedTextTest {

    @Test
    fun `display returns Thai by default`() {
        val text = LocalizedText(th = "อาหาร", en = "Food")
        assertEquals("อาหาร", text.display())
    }

    @Test
    fun `display returns English when specified`() {
        val text = LocalizedText(th = "อาหาร", en = "Food")
        assertEquals("Food", text.display("en"))
    }

    @Test
    fun `display falls back to Thai when English is empty`() {
        val text = LocalizedText(th = "อาหาร", en = "")
        assertEquals("อาหาร", text.display("en"))
    }
}

class CartItemTest {

    @Test
    fun `cart item defaults`() {
        val item = CartItem(productId = "p1", quantity = 2)
        assertEquals("p1", item.productId)
        assertEquals(2, item.quantity)
        assertNull(item.variantId)
    }
}

class CheckoutInputTest {

    @Test
    fun `checkout input defaults`() {
        val input = CheckoutInput(addressId = "addr1")
        assertEquals("cod", input.paymentMethod)
        assertEquals("standard", input.shippingMethod)
        assertNull(input.note)
    }
}
