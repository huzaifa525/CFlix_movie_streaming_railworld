const giftForm = document.getElementById('giftForm');
const paymentContainer = document.getElementById('paymentContainer');
const paymentGateway = document.getElementById('paymentGateway');

giftForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const plan = document.getElementById('plan').value;
    const duration = document.getElementById('duration').value;

    const planOptions = {
        'basic': { name: 'Basic', price: 9.99 },
        'standard': { name: 'Standard', price: 15.99 },
        'premium': { name: 'Premium', price: 19.99 }
    };

    const selectedPlan = planOptions[plan];
    const totalCost = selectedPlan.price * duration;

    const paymentHTML = `
        <div class="payment-details">
            <h2>Payment Details</h2>
            <p>Gift from: ${name}</p>
            <p>Recipient: ${email}</p>
            <p>Plan: ${selectedPlan.name}</p>
            <p>Duration: ${duration} month(s)</p>
            <p>Total Cost: $${totalCost.toFixed(2)}</p>
            <button id="proceedToPayment">Proceed to Payment</button>
        </div>
    `;

    paymentContainer.innerHTML = paymentHTML;

    const proceedToPayment = document.getElementById('proceedToPayment');
    proceedToPayment.addEventListener('click', () => {
        showPaymentGateway();
    });
});

function showPaymentGateway() {
    const paymentGatewayHTML = `
        <div class="payment-form">
            <h2>Payment Gateway</h2>
            <div class="form-group">
                <label for="cardName">Name on Card:</label>
                <input type="text" id="cardName" required>
            </div>
            <div class="form-group">
                <label for="cardNumber">Card Number:</label>
                <input type="text" id="cardNumber" required>
            </div>
            <div class="form-group">
                <label for="expiry">Expiry Date:</label>
                <input type="text" id="expiry" placeholder="MM/YY" required>
            </div>
            <div class="form-group">
                <label for="cvv">CVV:</label>
                <input type="text" id="cvv" required>
            </div>
            <button id="confirmPayment" class="btn">Confirm Payment</button>
        </div>
    `;

    paymentGateway.innerHTML = paymentGatewayHTML;
    paymentGateway.classList.remove('hidden');

    const confirmPayment = document.getElementById('confirmPayment');
    confirmPayment.addEventListener('click', processPayment);
}

function processPayment() {
    const cardName = document.getElementById('cardName').value;
    const cardNumber = document.getElementById('cardNumber').value;
    const expiry = document.getElementById('expiry').value;
    const cvv = document.getElementById('cvv').value;

    // Mock payment processing logic
    const isPaymentSuccessful = mockPaymentProcessor(cardNumber, expiry, cvv);

    if (isPaymentSuccessful) {
        alert('Payment Successful!');
        // Perform any additional actions, such as sending a gift code to the recipient
    } else {
        alert('Payment Failed. Please check your card details and try again.');
    }
}

function mockPaymentProcessor(cardNumber, expiry, cvv) {
    // This is a mock function to simulate payment processing
    // In a real application, you would integrate with a payment gateway API
    // For this example, we'll assume the payment is successful if the card number starts with '4'
    const isValidCardNumber = cardNumber.startsWith('4');
    const isValidExpiry = expiry.match(/^(0[1-9]|1[0-2])\/\d{2}$/); // mm/yy format
    const isValidCVV = cvv.length === 3 && !isNaN(cvv);

    return isValidCardNumber && isValidExpiry && isValidCVV;
}